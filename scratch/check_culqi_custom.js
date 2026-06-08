const https = require('https');

https.get('https://js.culqi.com/checkout-js', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const matches = data.match(/window\.([a-zA-Z0-9_]*Culqi[a-zA-Z0-9_]*)/gi);
    const unique = [...new Set(matches)];
    console.log("Found window properties:", unique);
    
    // Also find class declarations or assignments
    const classes = data.match(/class ([a-zA-Z0-9_]*Culqi[a-zA-Z0-9_]*)/gi);
    console.log("Found classes:", [...new Set(classes)]);
    
    const idx = data.toLowerCase().indexOf('culqicheckout');
    console.log("Index of culqicheckout:", idx !== -1);
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
