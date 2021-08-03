require('jest');
const v1StableOutput = JSON.parse(
  require('fs')
    .readFileSync(require('path').join(__dirname, './output-v1-stable.json'))
    .toString()
);

const expectedSnapshotData = Object.fromEntries(
  Object.entries(v1StableOutput.data.snapshots_new[0].snapshot_data).map(
    ([k, v]) => {
      return [
        k,
        Object.fromEntries(
          Object.entries(v).map(([k2, v2]) => {
            return [
              k2,
              v2
                .map((val, index) => {
                  return [index, val];
                })
                .filter(([_k, v]) => !!v),
            ];
          })
        ),
      ];
    }
  )
);

const v2OptimizedOutput = JSON.parse(
  require('fs')
    .readFileSync(require('path').join(__dirname, './output.json'))
    .toString()
);

expect({
  data: {
    snapshots_new: [
      {
        snapshot_data: expectedSnapshotData,
      },
    ],
  },
}).toEqual(v2OptimizedOutput);

require('fs').writeFileSync(
  require('path').join(__dirname, './expected-output-v1-stable.json'),
  JSON.stringify({
    data: {
      snapshots_new: [
        {
          snapshot_data: expectedSnapshotData,
        },
      ],
    },
  })
);
