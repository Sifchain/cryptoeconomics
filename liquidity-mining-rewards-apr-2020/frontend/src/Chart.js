import * as d3 from 'd3';
import React from 'react';
import JSONPretty from 'react-json-pretty';

var margin = { top: 10, right: 30, bottom: 30, left: 60 },
  width = 860 - margin.left - margin.right,
  height = 400 - margin.top - margin.bottom;

class Chart extends React.Component {
  constructor(props) {
    super(props);
    this.myRef = React.createRef();
  }

  renderD3() {
    const d = this.props.data;
    const xFunc = this.props.xFunc;
    const yFunc = this.props.yFunc;

    var svg = d3.select(this.myRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

    // X scale and Axis
    var x = d3.scaleLinear()
      .domain(d3.extent(d, d => xFunc(d)))         // This is the min and the max of the data: 0 to 100 if percentages
      .range([0, width]);       // This is the corresponding value I want in Pixel

    svg
      .append('g')
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

    // Y scale and Axis
    var y = d3.scaleLinear()
      .domain(d3.extent(d, d => yFunc(d)))         // This is the min and the max of the data: 0 to 100 if percentages
      .range([height, 0]);       // This is the corresponding value I want in Pixel

    svg
      .append('g')
      .call(d3.axisLeft(y));

    svg.append("path")
      .datum(this.props.data)
      .attr("fill", "#cce5df")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 1.5)
      .attr("d", d3.area()
        .x(d => x(xFunc(d)))
        .y0(y(0))
        .y1(d => y(yFunc(d)))
      )
  }

  clearD3() {
    d3.select(this.myRef.current).select('svg').remove()
  }

  componentDidMount() {
    this.renderD3()
  }

  componentDidUpdate() {
    console.log('updating')
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
export default Chart;
