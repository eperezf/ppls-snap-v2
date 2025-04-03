# Pisapapeles Social Network Autoposter (SNAP)

This repo is a (now unused) social network autoposter. It checks for the latest post in https://pisapapeles.net and posts it to Facebook, Twitter (X) and Telegram.
It runs on a Lambda function and must be configured with a cron to check the latest post (as wordpress.org version of WordPress lacks webhooks).

## Requirements
* AWS Account
* S3 Bucket
* Lambda function with permission to write to the S3 bucket
* Facebook Access Token
* Twitter app credentials
* Telegram token and bot

## Usage
1. Clone the repo
2. Go to the folder where you cloned the repo
3. run ```npm install```
4. Upload the folder to your Lambda function (including ```node_modules```)
5. Setup a cron (usually every minute. Less if posting is not frequent)

