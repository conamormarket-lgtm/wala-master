const https = require('https');

https.get('https://checkout.culqi.com/js/v4', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const idx = data.toLowerCase().indexOf('culqicheckout');
    console.log("Index of culqicheckout:", idx);
    if (idx !== -1) {
      console.log("Context:", data.substring(idx - 50, idx + 50));
    }
  });
});
