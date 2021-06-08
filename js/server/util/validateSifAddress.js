const { Bech32 } = require('@cosmjs/encoding');
exports.validateSifAddress = address => {
  let isValid = true;
  try {
    Bech32.decode(address);
  } catch (e) {
    isValid = false;
  }
  return { isValid: isValid };
};
