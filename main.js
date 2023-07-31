import './style.css';

const url = document.querySelector('#url');
const progressSub = document.querySelector('#progressSub');
const progressCalc = document.querySelector('#progressCalc');
const progressInvoice = document.querySelector('#progressInvoice');
const progressPay = document.querySelector('#progressPay');
const progressTranscribe = document.querySelector('#progressTranscribe');
const progressView = document.querySelector('#progressView');
const submit = document.querySelector('#submit');
const sleep = (m) => new Promise((r) => setTimeout(r, m));

function getDurationInSeconds(remoteUrl, callback) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(remoteUrl);

    audio.addEventListener('loadedmetadata', function () {
      resolve(audio.duration);
    });

    audio.addEventListener('error', function () {
      reject('Could not determine audio duration');
    });
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
    /* UI Progress Logic */
    progressSub.classList.replace('current', 'complete');
    progressCalc.classList.replace('next', 'current');

    const durationInSeconds = await getDurationInSeconds(url.value);
    const isUnderTwoHours = durationInSeconds < 7200;

    /* UI Progress Logic */
    progressCalc.classList.replace('current', 'complete');
    progressInvoice.classList.replace('next', 'current');

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

    /* UI Progress Logic */
    progressInvoice.classList.replace('current', 'complete');
    progressPay.classList.replace('next', 'current');

    const macaroon = authHeader.split('macaroon="')[1].split('"')[0];
    const invoice = authHeader.split('invoice="')[1].split('"')[0];

    const payment = await window.webln.sendPayment(invoice);
    const preimage = payment.preimage;

    /* UI Progress Logic */
    progressPay.classList.replace('current', 'complete');
    progressTranscribe.classList.replace('next', 'current');

    const transcript = await fetch('https://transcribe.fm/api/v1/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `L402 ${macaroon}:${preimage}`,
      },
      body: JSON.stringify({
        audio_url: url.value,
        ...(isUnderTwoHours && { format: 'txt' }),
      }),
    });

    if (transcript.status === 200) {
      /* UI Progress Logic */
      progressTranscribe.classList.replace('current', 'complete');
      progressView.classList.remove('next');

      if (isUnderTwoHours) {
        /* UI Progress Logic */
        progressView.classList.replace('next', 'complete');

        // assume response is text
        document.querySelector(
          '#results'
        ).innerHTML = `<pre>${await transcript.text()}</pre>`;
      } else {
        /* UI Progress Logic */
        progressView.classList.replace('next', 'current');

        // assume response is transcript_id
        const { transcript_id } = await transcript.json();
        // wait 5 seconds
        await sleep((durationInSeconds / 120) * 1000); // wait 1/120th of the duration
        // fetch txt file
        const text = await fetch(
          `https://transcribe.fm/transcript/${transcript_id}.txt`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'text/plain',
            },
          }
        );

        /* UI Progress Logic */
        progressView.classList.replace('current', 'complete');

        // return text
        document.querySelector(
          '#results'
        ).innerHTML = `<pre>${await text.text()}</pre>`;
      }
    } else {
      const err = await transcript.text();
      throw new Error(err);
    }
  } catch (error) {
    /* UI Progress Logic */
    document
      .querySelector('#progress .current')
      .classList.replace('current', 'error');

    console.log(error);
  }
});
