# vaccine-notifier

### Setup

1. Sign up for a twilio account. The free trial is fine.
2. Fill in your Twilio info at the top of the script.
3. Modify the locations if needed (check the CVS and NYS Vaccine portals for available locations)
4. Edit the lat/long on line 170 for Walgreens
5. Install dependencies `$ npm install`
6. Install `forever` `$ npm install -g forever`
7. Start the script `$ forever start index.js`
