import 'dotenv/config'
import fb from 'fb';
import TwitterApi from 'twitter-api-v2';
import WPAPI from 'wpapi';
import TelegramBot from 'node-telegram-bot-api';
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";


export const handler = async (event) => {
	// Initialize bots
	console.log('Initializing Bots...');
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
	console.log("Done");

	// initialize S3 connection
	const s3 = new S3Client({ region: 'us-east-1' });

	// Initialize variables
  var newPosts = [];
	var oldPosts = [];

  // Get the latest posts
	console.log('Getting latest posts...');
  const wp = new WPAPI({ endpoint: 'https://pisapapeles.net/wp-json' });
	try {
		const posts = await wp.posts()
		posts.forEach(post => {
			newPosts.push(
				{
					title: post.yoast_head_json.title,
					description: post.yoast_head_json.description,
					tags: post.tags,
					link: post.link,
					id: post.id
				}
			)
		});
	} catch (error) {
		console.log("Error getting posts");
		console.log(error);
		return error;
	}
	console.log('Done');
	newPosts.sort((a, b) => a.id - b.id);


	// Get the saved posts
	console.log('Reading JSON from S3');
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
				Body: JSON.stringify(newPosts)
			});
			await s3.send(command);
			return 'No posts.json file found. Creating one with the latest posts';
		} else {
			console.log(error);
			return error;
		}
	}
	console.log('Done');

	// If we're here, we have new and old posts. Let's compare them
	console.log('Comparing posts...');
	// Sort the posts by ID first
	
	newPosts.forEach(post => {
		let found = oldPosts.find(oldPost => oldPost.id === post.id);
		if (!found) {
			if (post.tags.includes(14354)){
				console.log("POST ID " + post.id + " is has norrss tag. Skipping");
				post.status = "skip";
			} else {
				console.log("POST ID " + post.id + " is new. Adding to pending");
				post.status = "pending";
				oldPosts.push(post);
			}
		} else {
			//console.log("POST ID " + post.id + " is old. Skipping");
		}

	});

	oldPosts.sort((a, b) => a.id - b.id);
	//console.log("----------");

	// oldPosts.forEach(post => {
	// 	console.log(post.id + " - " + post.status);
	// });


	for (const post of oldPosts) {
		if (post.status == "pending") {
			console.log("POST ID " + post.id + " is pending. Posting to:");
			console.log("Facebook...");
			const fbres = await postToFB(post.title, post.link);
			console.log(fbres);
			console.log("Twitter...");
			const twres = await rwClient.v2.tweet({text: post.title + " " + post.link});
			console.log(twres);
			console.log("Telegram...");
			const tgres = await bot.sendMessage("@Pisapapeles", post.title + " " + post.link);
			console.log(tgres);
			post.status = "posted";
		}
	}


	// Save the new posts
	console.log('Saving new posts...');
	const command = new PutObjectCommand({
		Bucket: 'ppls-services',
		Key: 'posts.json',
		Body: JSON.stringify(oldPosts)
	});
	try {
		await s3.send(command);
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

