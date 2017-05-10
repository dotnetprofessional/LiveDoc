import * as React from 'react';
//import './App.css';
var View = require('react-native-web').View;
import { Header, FeatureSummary } from './Components';
import * as model from './model/Feature';

//const logo = require('./logo.svg');
const data: model.Feature[] = require('./livedoc.json');

const features: model.Feature[] = [];
data.forEach(featureData => {
  const feature = Object.assign(new model.Feature(), featureData);
  features.push(feature);
});

console.log(features);

class App extends React.Component<{}, null> {
  render() {
    return (
      <View>
        <Header />
        <FeatureSummary features={features} />
      </View>
    );
  }
}

export default App;
