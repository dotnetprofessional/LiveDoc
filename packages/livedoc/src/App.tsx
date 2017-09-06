import * as React from 'react';
import * as Bootstrap from "react-bootstrap";
var Router = require("react-router-dom").BrowserRouter;
var Route = require("react-router-dom").Route;

// import './App.css';
// var Text = require('react-native-web').Text;

import { Header, FeatureSummary, Feature, View } from './Components';
import * as model from 'livedoc-model';

// const logo = require('./logo.svg');
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
      <Router>
        <View>
          <Header />
          <Bootstrap.Grid >
            <Bootstrap.Row>
              <Route exact={true} path="/" render={() => (
                <FeatureSummary features={features} />
              )} />
              <Route path="/feature/:id" render={({ match }) => {
                console.log("Id: ", features[1].id);
                const f = features.find(f => f.id == match.params.id);
                // const f = features[1];
                return (
                  <Feature {...f } />
                );
              }} />
            </Bootstrap.Row>

          </Bootstrap.Grid>
        </View>
      </Router>
    );
  }
}

export default App;
