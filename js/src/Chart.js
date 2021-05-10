import * as d3 from 'd3';
import React from 'react';
import { timestampToDate } from './utils';

let margin = { top: 10, right: 30, bottom: 30, left: 60 };
let width = 860 - margin.left - margin.right;
let height = 400 - margin.top - margin.bottom;

class Chart extends React.Component {
  constructor (props) {
    super(props);
    this.myRef = React.createRef();
  }

  renderD3 () {
    const data = this.props.data;

    let svg = d3
      .select(this.myRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // X scale and Axis
    let x = d3
      .scaleUtc()
      .domain(d3.extent(data, d => timestampToDate(d.timestamp)))
      .range([0, width]); // This is the corresponding value I want in Pixel

    svg
      .append('g')
      .attr("class", "axis")
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(x));

    // Y scale and Axis
    let y = d3
      .scaleLinear()
      .domain(d3.extent(data, d => d.userClaimableReward)) // This is the min and the max of the data: 0 to 100 if percentages
      .range([height, 0]); // This is the corresponding value I want in Pixel

    svg.append('g')
      .attr("class", "axis")
      .call(d3.axisLeft(y));

    svg
      .append('path')
      .datum(data)
      .attr('fill', '#70ebb1')
      .attr('stroke', '#70ebb1')
      .attr('stroke-width', 1.5)
      .attr(
        'd',
        d3
          .area()
          .x(d => x(timestampToDate(d.timestamp)))
          .y0(y(0))
          .y1(d => y(d.userClaimableReward))
      );
  }

  clearD3 () {
    d3.select(this.myRef.current)
      .select('svg')
      .remove();
  }

  componentDidMount () {
    this.renderD3();
  }

  componentWillUnmount () {
    this.clearD3();
  }

  componentDidUpdate () {
    this.clearD3();
    this.renderD3();
  }

  render () {
    return <div ref={this.myRef} className='chart' />;
  }
}
export default Chart;
