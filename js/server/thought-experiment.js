(function () {
  const ft = new Date('2021-02-19T06:48:43+00:00').valueOf();
  let now = new Date(new Date().toISOString()).valueOf();

  const epoch_arr = [];
  while (now > ft) {
    const new_now = now - 200 * 60 * 1000;
    epoch_arr.push({ begin: new_now, end: now });
    now = new_now;
  }
  const expectedFinalIndex = epoch_arr.length - 1;
  const expectedCurrentIndexNotInSnapshotYet = expectedFinalIndex + 1;
  const actualCurrentIndex = Math.floor((Date.now() - ft) / 1000 / 60 / 200);
  /* 
    Thought experiments: 
      1. You deposit one second after the start datetime. 
        - What index are you in? 
          * Zero. The first index.
        - What time should your transaction be grouped under?
          * 200 minutes after the start time
      2. You deposit one second before the end datetime. 
        - What index are you in? 
          * The last index.
        - What time should your transaction be grouped under?
          * End date time
  */
  console.log(
    epoch_arr.length,
    // this should be true because the present snapshot hasn't been recorded yet
    epoch_arr[actualCurrentIndex] === undefined,
    '\nBegin at: ' +
      new Date(epoch_arr[epoch_arr.length - 1].begin).toUTCString(),
    '\nEnd at: ' + new Date(epoch_arr[epoch_arr.length - 1].end).toUTCString(),
    '\n' + expectedCurrentIndexNotInSnapshotYet,
    actualCurrentIndex
  );
})();
