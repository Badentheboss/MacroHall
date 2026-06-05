const umich = require('./umich');
const utAustin = require('./utAustin');
const ohioState = require('./ohioState');

const adapters = {
  [umich.id]: umich,
  [utAustin.id]: utAustin,
  [ohioState.id]: ohioState,
};

function getAdapter(adapterId) {
  const adapter = adapters[adapterId];
  if (!adapter) {
    throw new Error(`No parser adapter registered for: ${adapterId}`);
  }
  return adapter;
}

module.exports = {
  getAdapter,
};
