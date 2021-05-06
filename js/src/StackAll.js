import * as d3 from 'd3';
import { timestampToDate } from './utils'
import React from 'react';
import {
  fetchStack
} from './api';

// const totalInitialRowan = rewardBucketsTimeSeries[0].totalInitialRowan

class StackAll extends React.Component {

  constructor(props) {
    super(props);
    this.myRef = React.createRef();
    this.state = {}
  }

  renderD3() {
    const data = this.state.rewardData
    const users = Object.keys(data[0]).filter(key => key !== 'timestamp')

    const series = d3.stack().keys(users)(data)

    var margin = { top: 10, right: 30, bottom: 30, left: 60 },
      width = 860 - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

    const x = d3.scaleUtc()
      .domain(d3.extent(data, d => timestampToDate(d.timestamp)))
      .range([margin.left, width - margin.right])

    const yDomain = d3.max(series, d => d3.max(d, d => d[1]))
    const y = d3.scaleLinear()
      .domain([0, yDomain]).nice()
      .range([height - margin.bottom, margin.top])

    const area = d3.area()
      .x((d, xIndex) => {
        const timestamp = xIndex * 200
        return x(timestampToDate(timestamp))
      })
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))

    const color = d3.scaleOrdinal()
      .domain(users)
      .range(d3.schemeCategory10)

    const xAxis = g => g
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0))

    const yAxis = g => g
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select(".domain").remove())
      .call(g => g.select(".tick:last-of-type text").clone()
        .attr("x", 3)
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text(data.y))

    const svg = d3.select(this.myRef.current)
      .append("svg")
      .attr("viewBox", [0, 0, width, height]);

    svg.append("g")
      .selectAll("path")
      .data(series)
      .join("path")
      .attr("fill", ({ key }) => color(key))
      .attr("d", area)
      .append("title")
      .text(({ key }) => key);

    svg.append("g")
      .call(xAxis);

    svg.append("g")
      .call(yAxis);

  }

  clearD3() {
    d3.select(this.myRef.current).select('svg').remove()
  }

  componentDidMount() {
    fetchStack(this.props.type)
      .then(({ rewardData }) => {
        this.setState({ rewardData }, this.renderD3)
      })
  }

  componentWillUnmount() {
    this.clearD3()
  }

  render() {
    if (!this.state.rewardData) {
      <div>Loading...</div>
    }
    return (
      <div ref={this.myRef} className='chart'>
      </div>
    );
  }

}
export default StackAll;
