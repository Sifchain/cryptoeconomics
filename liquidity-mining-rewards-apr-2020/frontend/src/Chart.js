import { PieChart } from 'react-dc-js';
import crossfilter from 'crossfilter2';
import { raw, users } from './dataParsed';
import * as d3 from 'd3';

class Chart extends React.Component {
  constructor(props) {
    super(props);
    this.myRef = React.createRef();
    this.dataset = [100, 200, 300, 400, 500];
  }
  componentDidMount() {
    d3.select(this.myRef.current)
      .append('p')
      .text('Hello from D3');
  }
  render() {
    return (
      <div ref={this.myRef}>
      </div>
    );
  }

}
export default Chart;
