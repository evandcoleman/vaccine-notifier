const fetch = require('node-fetch');
const twilio = require('twilio');
var cron = require('node-cron');

/*
 * Log steps to debug in Scriptable
 */
const debug = true;

/*
 * Limit results to only specific locations
 * when onlyMyLocations is true.
 */
const myLocations = [
  "South Ozone Park, NY",
  "White Plains, NY",
  "Wantagh, NY",
  "New York, NY",
  "Carmel, NY",
  "Eastchester, NY",
  "STONY POINT, NY"
].map(x => x.toLowerCase());

/*
 * Filter locations to the list in myLocations.
 */
const onlyMyLocations = true;

var accountSid = ''; // Your Account SID from www.twilio.com/console
var authToken = '';   // Your Auth Token from www.twilio.com/console
var fromNumber = ''; // Your from phone number from twilio include '+1'
var toNumber = ''; // The phone number to send to include '+1'

var client = new twilio(accountSid, authToken);

let lastMessageText = null;

cron.schedule('0,15,30,45 * * * *', () => {
  console.log('checking availability...');
  (async () => {
    try {
      const nysAvailableLocations = await fetchNYS();
      const cvsAvailableLocations = await fetchCVS();
      const walgreensAvailableLocations = await fetchWalgreens();

      const availableLocations = nysAvailableLocations
        .concat(cvsAvailableLocations)
        .concat(walgreensAvailableLocations);

      /*
       * Set a notification body based on whether
       * or not there are results.
       * If alwaysNotify is true, a fallback message
       * will be sent when no appointments are
       * available.
       */
      if (availableLocations.length) {
        let body = "Locations:";
        for (let i=0; i<availableLocations.length; i++)         {
          body += ` ${availableLocations[i].address}${i < availableLocations.length - 1 ? ';' : '' }`;
        }

        if (body !== lastMessageText) {
          console.log('sending', body);
          await client.messages.create({
            body,
            to: toNumber,
            from: fromNumber,
          })
          lastMessageText = body;
        } else {
          console.log(body, 'matches', lastMessageText, 'skipping...');
        }
      } else {
        lastMessageText = null;
        console.log("No appointments available");
      }
    } catch (error) {
      lastMessageText = null;
      console.log(error);
    }
  })();
});

async function fetchNYS() {
  
  const request = await fetch("https://am-i-eligible.covid19vaccine.health.ny.gov/api/list-providers");

  const response = await request.json();
  if (debug) {
    console.log(response.providerList);
  }

  const myLocationsData = onlyMyLocations ? response.providerList.filter((location) => {
    return myLocations.includes(location.address);
  }) : response.providerList;
  if (debug) {
    console.log(myLocationsData);
  }


  const availableLocations = myLocationsData.filter((location) => {
    return location.availableAppointments === "AA";
  });
  if (debug) {
    console.log(availableLocations);
  }

  return availableLocations;
}

async function fetchCVS() {
  /*
   * Request appointment data from the website.
   */
  const request = await fetch("https://www.cvs.com/immunizations/covid-19-vaccine.vaccine-status.NY.json", {
    headers: {
      Referer: 'https://www.cvs.com/immunizations/covid-19-vaccine',
    }
  });

  let response = await request.json();
  if (debug) {
    console.log(response.responsePayloadData);
  }
  response = response.responsePayloadData.data.NY.map(x => ({
    address: `${x.city}, ${x.state}`,
    ...x
  }));

  /*
   * If onlyMyLocations is true, filter all of the 
   * data down to only the addresses in myLocations,
   * otherwise use all of the locations.
   */
  const myLocationsData = onlyMyLocations ? response.filter((location) => {
    return myLocations.includes(location.address.toLowerCase());
  }) : response.providerList;
  if (debug) {
    console.log(myLocationsData);
  }


  /*
   * From the results of myLocations, find
   * the locations where appointments are available.
   */
  const availableLocations = myLocationsData.filter((location) => {
    return location.status !== "Fully Booked";
  });
  if (debug) {
    console.log(availableLocations);
  }

  return availableLocations;
}

async function fetchWalgreens() {
  /*
   * Request appointment data from the website.
   */
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1);
  const request = await fetch("https://www.walgreens.com/hcschedulersvc/svc/v1/immunizationLocations/availability", {
    "method": "POST",
    "headers": {
          "Content-Type": "application/json; charset=utf-8"
    },
    "body": `{\"serviceId\":\"99\",\"position\":{\"latitude\":41.0725142,\"longitude\":-73.9266363},\"appointmentAvailability\":{\"startDateTime\":\"${tomorrow.toISOString().split('T')[0]}\"},\"radius\":25}`
  });

  let response = await request.json();
  if (debug) {
    console.log(response);
  }

  if (response.appointmentsAvailable === true) {
    return [{ address: 'Walgreens'}];
  }

  return [];
}