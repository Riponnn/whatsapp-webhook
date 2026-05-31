const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'secret2244';
const PIXEL_ID = process.env.PIXEL_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PAGE_ID = process.env.PAGE_ID;

function hashPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return crypto.createHash('sha256').update(cleaned).digest('hex');
}

async function sendLeadEvent(phone, timestamp, referral) {
  const ctwaClid = referral?.ctwa_clid || 'ARAkLkA8rmlcHUNsKTJ8';

  const userData = {
    ph: [hashPhone(phone)],
    page_id: PAGE_ID
  };

  if (ctwaClid) {
    userData.ctwa_clid = ctwaClid;
  }

  const payload = {
    data: [
      {
        event_name: 'LeadSubmitted',
        event_time: parseInt(timestamp),
        action_source: 'business_messaging',
        messaging_channel: 'whatsapp',
        user_data: userData,
        test_event_code: process.env.TEST_CODE
      }
    ]
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      payload
    );
    console.log('CAPI Success:', JSON.stringify(response.data));
  } catch (error) {
    console.log('CAPI Error:', error.response?.data || error.message);
  }
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const phone = message.from;
      const timestamp = message.timestamp;
      const referral = message.referral || {};

      console.log('Lead detected - Phone:', phone);

      if (referral.ctwa_clid) {
        console.log('CTWA clid found:', referral.ctwa_clid);
      } else {
        console.log('No CTWA clid - organic or test message');
      }

      await sendLeadEvent(phone, timestamp, referral);
    }
  } catch (err) {
    console.log('Error processing message:', err.message);
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
