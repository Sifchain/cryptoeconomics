import * as d3 from 'd3';
import React from 'react';
import { swatches } from "@d3/color-legend"

margin = ({ top: 20, right: 30, bottom: 30, left: 40 })
height = 500

class Stack extends React.Component {
  constructor(props) {
    super(props);
    this.myRef = React.createRef();
  }

  renderD3() {
    const data = this.props.data;
    const xFunc = this.props.xFunc;
    const yFunc = this.props.yFunc;

    series = d3.stack().keys(data.columns.slice(1))(data)

    const svg = d3.select(this.myRef.current).create("svg")
      .attr("viewBox", [0, 0, width, height]);

    color = d3.scaleOrdinal()
      .domain(data.columns.slice(1))
      .range(d3.schemeCategory10)

    area = d3.area()
      .x(d => x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))

    svg.append("g")
      .selectAll("path")
      .data(data)
      .join("path")
      .attr("fill", ({ key }) => color(key))
      .attr("d", area)
      .append("title")
      .text(({ key }) => key);

    x = d3.scaleUtc()
      .domain(d3.extent(data, d => d.date))
      .range([margin.left, width - margin.right])
    xAxis = g => g
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0))
    svg.append("g")
      .call(xAxis);

    y = d3.scaleLinear()
      .domain([0, d3.max(series, d => d3.max(d, d => d[1]))]).nice()
      .range([height - margin.bottom, margin.top])
    yAxis = g => g
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select(".domain").remove())
      .call(g => g.select(".tick:last-of-type text").clone()
        .attr("x", 3)
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text(data.y))
    svg.append("g")
      .call(yAxis);
  }

  clearD3() {
    d3.select(this.myRef.current).select('svg').remove()
  }

  componentDidMount() {
    this.renderD3()
  }

  componentDidUpdate() {
    this.clearD3()
    this.renderD3()
  }

  render() {
    return (
      <div ref={this.myRef} className='chart'>
      </div>
    );
  }

}
export default Stack;
