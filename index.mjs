import 'dotenv/config'
import fb from 'fb';
import TwitterApi from 'twitter-api-v2';
import WPAPI from 'wpapi';
import TelegramBot from 'node-telegram-bot-api';
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";


export const handler = async (event) => {
	// Initialize bots
	// console.log('Initializing Bots...');
	// Facebook
  const res = fb.setAccessToken(process.env.fbAccessToken)
	// Twitter
	const twClient = new TwitterApi.TwitterApi({
    appKey: process.env.twitterConsumerKey,
    appSecret: process.env.twitterConsumerSecret,
    accessToken: process.env.twitterAccessToken,
    accessSecret: process.env.twitterAccessTokenSecret,
  });
	const rwClient = twClient.readWrite;
	// Telegram
  const bot = new TelegramBot(process.env.telegramToken, {polling: false});
	// console.log("Done");

	// initialize S3 connection
	const s3 = new S3Client({ region: 'us-east-1' });

	// Initialize variables
	var oldPosts = [];
	var latestPost = {};

  // Get the latest posts
	// console.log('Getting latest post...');
  const wp = new WPAPI({ endpoint: 'https://pisapapeles.net/wp-json' });
	try {
		latestPost = await wp.posts().order('desc').orderby('date').perPage(1);
	} catch (error) {
		console.log("Error getting post");
		console.log(error);
		return error;
	}
	//console.log('Done');
	latestPost = {
		id: latestPost[0].id,
		title: latestPost[0].title.rendered,
		description: latestPost[0].excerpt.rendered,
		link: latestPost[0].link,
		tags: latestPost[0].tags,
		date: latestPost[0].date
	};

	// Get the saved posts
	// console.log('Reading JSON from S3');
	try {
		const command = new GetObjectCommand({
			Bucket: 'ppls-services',
			Key: 'posts.json'
		});
		const data = await s3.send(command);
		const parsedData = await data.Body.transformToString();
		oldPosts = JSON.parse(parsedData);
	} catch (error) {
		if (error.name === 'NoSuchKey') {
			console.log('No posts.json file found. Creating one with the latest posts and setting them to posted');
			newPosts.forEach(post => {
				post.status = "posted";
			});
			const command = new PutObjectCommand({
				Bucket: 'ppls-services',
				Key: 'posts.json',
				Body: JSON.stringify([latestPost])
			});
			await s3.send(command);
			return 'No posts.json file found. Creating one with the latest post';
		} else {
			console.log(error);
			return error;
		}
	}

	//search the old posts and see if the new post is already there
	let found = oldPosts.find(oldPost => oldPost.id === latestPost.id);
	if (!found) {
		if (latestPost.tags.includes(14354)){
			console.log("POST ID " + latestPost.id + " is has norrss tag. Skipping");
			latestPost.status = "skip";
			oldPosts.push(latestPost);
		} else {
			let errored = false;
			console.log("POST ID " + latestPost.id + " is new. Posting to...");
			try {
				console.log("Twitter...");
				const twres = await rwClient.v2.tweet({text: latestPost.title + " " + latestPost.link + "?utm_source=twitter&utm_medium=social&utm_campaign=ap"});
			} catch (error) {
				console.log(error);
				errored = true;
			}
			try {
				console.log("Facebook...");
				const fbres = await postToFB(latestPost.title, latestPost.link + "?utm_source=facebook&utm_medium=social&utm_campaign=ap");
			} catch (error) {
				console.log(error);	
				errored = true;
			}
			try {
				console.log("Telegram...");
				const tgres = await bot.sendMessage("@Pisapapeles", latestPost.title + " " + latestPost.link + "?utm_source=telegram&utm_medium=social&utm_campaign=ap");
			} catch (error) {
				console.log(error);
				errored = true;
			}
			errored ? latestPost.status = "error" : latestPost.status = "posted";
			oldPosts.push(latestPost);
		}
	} else {
		//console.log("POST ID " + latestPost.id + " is old. Skipping");
	}

	// Save the new posts
	//console.log('Saving new posts...');
	const command = new PutObjectCommand({
		Bucket: 'ppls-services',
		Key: 'posts.json',
		Body: JSON.stringify(oldPosts)
	});
	try {
		await s3.send(command);
		//console.log('Posts saved');
	} catch (error) {
		console.log(error);
	}

	function postToFB(description, link) {
    fb.api(
      '/Pisapapeles/feed',
      'POST',
      {
        message: description,
        link: link
      },
      function (response) {
        return response;
      }
    )
  }

  // TODO implement
  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
};

