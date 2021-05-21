import React, { useEffect, useRef, useState } from 'react';
import { timestampToDate } from './utils';
import { Chart, _adapters, registerables } from 'chart.js';
import { registerChartDateAdapter } from './registerChartDateAdapter';
// let margin = { top: 10, right: 30, bottom: 30, left: 60 };
// let width = 860 - margin.left - margin.right;
// let height = 400 - margin.top - margin.bottom;
Chart.register(...registerables);
registerChartDateAdapter(_adapters);

export default props => {
  const myRef = useRef();
  const [chart, setChart] = useState(undefined);
  useEffect(() => {
    if (!(myRef.current && props.data)) return;
    let currentChart = renderChart(myRef.current, props.data, chart);
    if (!chart) {
      setChart(currentChart);
    }
  }, [myRef.current, props.data]);

  useEffect(() => {
    if (chart) chart.destroy();
  }, [props.data]);

  return (
    <div className='chart-container'>
      <canvas
        className='chart'
        ref={myRef}
        id='myChart'
        width='225'
        height='100'
      />
    </div>
  );
};

function renderChart (canvasElement, data, chart) {
  const createDatasets = () => {
    return [
      {
        tickColor: '#FAFAFA',
        borderColor: '#3B7FBA',
        borderWidth: 3,
        radius: 0,
        backgroundColor: 'rgba(59, 127, 186, 0.2)',
        fill: true,
        data: data.map(d => ({
          y: d.userClaimableReward,
          x: timestampToDate(d.timestamp)
        }))
      }
      // {
      //   borderColor: Utils.CHART_COLORS.blue,
      //   borderWidth: 1,
      //   radius: 0,
      //   data: data2,
      // },
    ];
  };
  if (chart) {
    chart.data.datasets = createDatasets();
    chart.update();
    return;
  }
  const totalDuration = 2000;
  const delayBetweenPoints = totalDuration / data.length;
  const previousY = ctx =>
    ctx.index === 0
      ? ctx.chart.scales.y.getPixelForValue(100)
      : ctx.chart
          .getDatasetMeta(ctx.datasetIndex)
          .data[ctx.index - 1].getProps(['y'], true).y;
  const animation = {
    x: {
      type: 'number',
      easing: 'linear',
      duration: delayBetweenPoints,
      from: NaN, // the point is initially skipped
      delay (ctx) {
        if (ctx.type !== 'data' || ctx.xStarted) {
          return 0;
        }
        ctx.xStarted = true;
        return ctx.index * delayBetweenPoints;
      }
    },
    y: {
      type: 'number',
      easing: 'linear',
      duration: delayBetweenPoints,
      from: previousY,
      delay (ctx) {
        if (ctx.type !== 'data' || ctx.yStarted) {
          return 0;
        }
        ctx.yStarted = true;
        return ctx.index * delayBetweenPoints;
      }
    }
  };

  const config = {
    type: 'line',
    data: {
      datasets: createDatasets()
    },
    options: {
      animation,
      interaction: {
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
            color: 'white',
            fontColor: 'white',
            textStrokeColor: 'white'
          },

          ticks: {
            color: 'rgba(255,255,255,0.9)'
          }
        }
      }
    }
  };
  const ctx = canvasElement.getContext('2d');

  return new Chart(ctx, config);
}
