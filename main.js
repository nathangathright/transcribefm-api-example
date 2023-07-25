import './style.css'

document.querySelector('#app').innerHTML = `
  <input type="url" id="url" name="url" placeholder="Enter a URL" value="https://podnews.net/audio/podnews230721.mp3" />
  <button id="submit">Transcribe</button>
`

const baseURL = (import.meta.env.PROD) ? 'https://transcribe.fm' : 'http://localhost:8080';
const url = document.querySelector('#url');
const submit = document.querySelector('#submit');

submit.addEventListener('click', async () => {
  if (typeof window.webln === "undefined") {
    return alert("No WebLN available.");
  }

  try {
    await window.webln.enable();
  } catch (error) {
    return alert("User denied permission or cancelled.");
  }

  try {
    const quote = await fetch(`${baseURL}/api/v1/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: url.value })
    });
    // expect 402 status code
    console.log(JSON.stringify(quote));
    const authHeader = quote.headers.get('WWW-Authenticate');
    const macaroon = authHeader.split('macaroon="')[1].split('"')[0];
    const invoice = authHeader.split('invoice="')[1].split('"')[0];

    const payment = await window.webln.sendPayment(invoice);
    const preimage = payment.preimage;

    const transcribe = await fetch(`${baseURL}/api/v1/transcribe`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `L402 ${macaroon}:${preimage}`
      },
      body: JSON.stringify({ audio_url: url.value })
    });
    const transcription = await transcribe.json();
  }
  catch (error) {
    console.log(error);
  }
});

