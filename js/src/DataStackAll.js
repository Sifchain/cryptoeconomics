import { timestampToDate } from './utils';
import React from 'react';
import { fetchStack } from './api';
import { Chart, _adapters, registerables } from 'chart.js';
import { registerChartDateAdapter } from './registerChartDateAdapter';
Chart.register(...registerables);
registerChartDateAdapter(_adapters);

// const totalInitialRowan = rewardBucketsTimeSeries[0].totalInitialRowan

class DataStackAll extends React.Component {
  constructor (props) {
    super(props);
    this.myRef = React.createRef();
    this.state = {};
    console.log('working');
  }

  renderD3 () {
    let self = this;
    function * createDatasets () {
      let data = self.state.rewardData;
      let addresses = Object.keys(data[0])
        .filter(k => k !== 'timestamp')
        .slice(0, 10);

      for (let addr of addresses) {
        yield {
          label: addr,
          borderColor: '#3B7FBA',
          borderWidth: 1.5,
          radius: 0,
          backgroundColor: 'rgba(59, 127, 186, 0.2)',
          fill: true,
          data: self.state.rewardData.map((d, xIndex) => {
            return {
              y: d[addr],
              x: timestampToDate(xIndex * 200)
            };
          })
        };
      }
    }
    const incrementallyUpdateChart = async chart => {
      let gen = createDatasets();
      chart.data.datasets = [];
      let datasets = [];
      let delay = 500;
      while (true) {
        const { value: next, done } = gen.next();
        if (done) break;
        datasets = [...datasets, next];
        chart.data.datasets = datasets;
        chart.update();
        console.log({ next });
        await new Promise((resolve, reject) => {
          setTimeout(resolve, delay);
        });
      }
    };

    if (this.state && this.state.chart) {
      return incrementallyUpdateChart(this.state.chart);
    }
    const config = {
      type: 'line',
      data: {
        datasets: []
      },
      options: {
        // animation,
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        plugins: {
          legend: false
        },
        scales: {
          x: {
            type: 'time',
            ticks: {
              color: 'rgba(255,255,255,0.9)'
            }
          },
          y: {
            title: {
              text: 'Rewards (ROWAN)',
              display: true,
              color: 'rgba(255,255,255,0.9)'
            },
            ticks: {
              color: 'rgba(255,255,255,0.9)'
            }
          }
        }
      }
    };
    const ctx = this.myRef.current.getContext('2d');
    const chart = new Chart(ctx, config);
    this.setState(
      {
        chart: chart
      },
      () => {
        incrementallyUpdateChart(chart);
      }
    );
  }

  clearD3 () {
    if (!this.state || !this.state.chart) return;
    this.state.chart.clear();
  }

  componentDidMount () {
    fetchStack(this.props.type).then(({ rewardData }) => {
      this.setState({ rewardData }, this.renderD3);
    });
  }

  componentWillUnmount () {
    this.clearD3();
  }

  render () {
    if (!this.state.rewardData) {
      <div>Loading...</div>;
    }
    return (
      <div className='chart-container'>
        <canvas
          className='chart'
          ref={this.myRef}
          id='myChart'
          width='225'
          height='100'
        />
      </div>
    );
  }
}
export default DataStackAll;
