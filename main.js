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
    const response1 = await fetch(`${baseURL}/api/v1/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: url.value }),
    });
    // NOTE: expect 402 status code
    const authHeader = response1.headers.get('WWW-Authenticate');
    const macaroon = authHeader.split('macaroon="')[1].split('"')[0];
    const invoice = authHeader.split('invoice="')[1].split('"')[0];

    const payment = await window.webln.sendPayment(invoice);
    const preimage = payment.preimage;

    const resppnse2 = await fetch(`${baseURL}/api/v1/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `L402 ${macaroon}:${preimage}`,
      },
      body: JSON.stringify({ audio_url: url.value }),
    });

    if (resppnse2.status === 200) {
      const { transcript_id } = await resppnse2.json();
      console.log(transcript_id);
      await sleep(2000);
      const results = await fetch(
        `${baseURL}/transcript/${transcript_id}.json`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const jsonResults = await results.json();
      document.querySelector('#results').innerHTML = `<pre>${JSON.stringify(
        jsonResults,
        null,
        2
      )}</pre>`;
    } else {
      const err = await resppnse2.text();
      throw new Error(err);
    }
  } catch (error) {
    console.log(error);
  }
});
