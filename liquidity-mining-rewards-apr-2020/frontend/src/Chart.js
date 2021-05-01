import * as d3 from 'd3';
import React from 'react';
import { raw, users } from './dataParsed';

class Chart extends React.Component {
  constructor(props) {
    super(props);
    this.myRef = React.createRef();
    this.dataset = [100, 200, 300, 400, 500];
  }

  componentDidMount() {
    let size = 500;
    let svg = d3.select(this.myRef.current)
    svg.attr("viewBox", [0, 0, width, height]);
    svg.append("g")
      .call(xAxis);
    svg.append("g")
      .call(yAxis);
    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 1.5)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("d", line);


  }
  render() {
    return (
      <div ref={this.myRef}>
      </div>
    );
  }

}
export default Chart;
