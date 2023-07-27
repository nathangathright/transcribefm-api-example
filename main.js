import './style.css';

document.querySelector('#app').innerHTML = `
  <input type="url" id="url" name="url" placeholder="Enter a URL" value="https://podnews.net/audio/podnews230721.mp3" />
  <button id="submit">Transcribe</button>
  <div id="results"></div>
`;

const baseURL = import.meta.env.PROD
  ? 'https://transcribe.fm'
  : 'http://localhost:8080';
const url = document.querySelector('#url');
const submit = document.querySelector('#submit');
const sleep = (m) => new Promise((r) => setTimeout(r, m));

function getDurationInSeconds(remoteUrl, callback) {
  const audio = new Audio(remoteUrl);
  
  audio.addEventListener('loadedmetadata', function() {
    const duration = audio.duration;
    callback(duration);
  });
  
  audio.addEventListener('error', function() {
    callback(null);
  });
}

submit.addEventListener('click', async () => {
  if (typeof window.webln === 'undefined') {
    return alert('No WebLN available.');
  }

  try {
    await window.webln.enable();
  } catch (error) {
    return alert('User denied permission or cancelled.');
  }

  try {
    const durationInSeconds = await getDurationInSeconds(url.value, (duration) => {
      return durationInSeconds;
    });

    const isUnderTwoHours = durationInSeconds < 7200;
    
    const quote = await fetch(`${baseURL}/api/v1/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: url.value }),
    });
    // NOTE: expect 402 status code
    const authHeader = quote.headers.get('WWW-Authenticate');
    const macaroon = authHeader.split('macaroon="')[1].split('"')[0];
    const invoice = authHeader.split('invoice="')[1].split('"')[0];

    const payment = await window.webln.sendPayment(invoice);
    const preimage = payment.preimage;

    const transcript = await fetch(`${baseURL}/api/v1/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `L402 ${macaroon}:${preimage}`,
      },
      body: JSON.stringify({
        audio_url: url.value,
        ...(isUnderTwoHours && { format: 'txt'})
      }),
    });

    if (transcript.status === 200) {
        if (isUnderTwoHours) {
          // assume response is text
          document.querySelector('#results').innerHTML = `<pre>${await transcript.text()}</pre>`;
        } else {
          // assume response is transcript_id
          const { transcript_id } = await transcript.json();
          // wait 5 seconds
          await sleep(5000);
          // fetch txt file
          const text = await fetch(`${baseURL}/transcript/${transcript_id}.txt`, {
            method: 'GET',
            headers: {
              'Content-Type': 'text/plain'
            }
          });
          // return text
          document.querySelector('#results').innerHTML = `<pre>${await text.text()}</pre>`;
        }
    } else {
      const err = await transcript.text();
      throw new Error(err);
    }
  } catch (error) {
    console.log(error);
  }
});
