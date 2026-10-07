require('dotenv').config();

const { createApp } = require('./src/server');

const port = Number(process.env.PORT || 3001);

createApp().listen(port, () => {
  console.log(`CollegeMacro backend is running on port ${port}`);
});
