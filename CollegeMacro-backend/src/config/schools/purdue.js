// Purdue's dining courts via the official HFS menus API.
module.exports = {
  slug: 'purdue',
  adapter: 'purdue-hfs',
  fetchMode: 'http',
  purdue: {
    locations: ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'],
  },
};
