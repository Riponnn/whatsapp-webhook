const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'secret2244';
const PIXEL_ID = process.env.PIXEL_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// Phone number hash করার function
function hashPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return crypto.createHash('sha256').update(cleaned).digest('hex');
}

// Meta CAPI-তে Lead event পাঠানোর function
async function sendLeadEvent(phone, timestamp) {
  const payload = {
    data: [
      {
        event_name: 'LeadSubmitted',
        event_time: parseInt(timestamp),
        action_source: 'business_messaging',
        messaging_channel: 'whatsapp',
        user_data: {
          ph: [hashPhone(phone)]
        }
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

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Incoming WhatsApp messages
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

      console.log('Lead detected - Phone:', phone);

      await sendLeadEvent(phone, timestamp);
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
