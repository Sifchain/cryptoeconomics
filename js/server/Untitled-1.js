const { client } = require('../index');

function calculateDateOfNextDispensation() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  while (true) {
    date.setHours(date.getHours() + 1);
    // output format: Friday, December 31, 2021 at 4:17:29 PM PST
    const formattedDate = new Intl.DateTimeFormat([], {
      timeZone: 'PST',
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(date);
    // dispensations are on Mondays at 8:00 AM PST
    if (
      formattedDate.includes('Monday') &&
      formattedDate.includes('8:00:00 AM PST')
    )
      break;
  }
  return date;
}

function getHumanReadableTimeUntil(date) {
  const diff = date.getTime() - new Date().getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / 1000 / 60) % 60);
  return `:watch: ${days}d ${hours}h ${mins}m`;
}

client.on('ready', async () => {
  const voiceChannel = await client.channels.cache.get('926256413196578846'); // fetching
  const nextDispensationDate = calculateDateOfNextDispensation();
  while (true) {
    try {
      const nextChannelName = getHumanReadableTimeUntil(nextDispensationDate);
      console.log(`Changing channel name to "${nextChannelName}"`);
      await voiceChannel.setName(nextChannelName);
    } catch (e) {
      console.error(e);
    }
    // wait 5 minutes
    await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 5));
  }
});
