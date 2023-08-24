import './style.css';

const url = document.querySelector('#url');
const submit = document.querySelector('#submit');
const sleep = (m) => new Promise((r) => setTimeout(r, m));

submit.addEventListener('click', async (event) => {
  event.preventDefault();
  submit.disabled = true;
  if (typeof window.webln === 'undefined') {
    return alert('No WebLN available.');
  }

  try {
    await window.webln.enable();
  } catch (error) {
    return alert('User denied permission or cancelled.');
  }

  try {
    submit.innerText = "Requesting invoice…";
    const quote = await fetch('https://transcribe.fm/api/v1/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: url.value }),
    });
    // NOTE: expect 402 status code
    const authHeader = quote.headers.get('WWW-Authenticate');

    if (!authHeader) {
      throw new Error('No WWW-Authenticate header');
    }

    const macaroon = authHeader.split('macaroon="')[1].split('"')[0];
    const invoice = authHeader.split('invoice="')[1].split('"')[0];

    submit.innerText = "Requesting payment…"
    const payment = await window.webln.sendPayment(invoice);
    const preimage = payment.preimage;

    submit.innerText = "Requesting transcription…"
    const transcript = await fetch('https://transcribe.fm/api/v1/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `L402 ${macaroon}:${preimage}`,
      },
      body: JSON.stringify({ audio_url: url.value }),
    });

    if (transcript.status === 200) {      
      const { transcript_id } = await transcript.json();

      submit.innerText = "Requesting Transcript as TXT…"
      const text = () => {
        return fetch(`https://transcribe.fm/api/v1/download/${transcript_id}`, {
          headers: {
            Accept: 'text/plain'
          },
        }
      )};

      let transcriptResponse = await text();
      while (transcriptResponse.status === 404) {
        submit.innerText = "Transcript not ready, waiting 1s…"
        await sleep(1000);
        transcriptResponse = await text();
      }
      submit.innerText = "Transcript received"
      document.querySelector('pre').innerHTML = await transcriptResponse.text();
    } else {
      const err = await transcript.text();
      throw new Error(err);
    }
  } catch (error) {
    console.log(error);
  }
});
