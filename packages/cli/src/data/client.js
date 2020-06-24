import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';

const APOLLO_STATE = window.__APOLLO_STATE__; // eslint-disable-line no-underscore-dangle
const client = new ApolloClient({
  cache: new InMemoryCache().restore(APOLLO_STATE),
  link: new HttpLink({
    uri: 'http://localhost:4000'
  })
});
const backupQuery = client.query;

client.query = (params) => {

  if (APOLLO_STATE) {
    // __APOLLO_STATE__ defined, in "SSG" mode...
    const root = window.location.pathname.split('/')[1];
    const rootSuffix = root === ''
      ? ''
      : '/';

    return fetch(`/${root}${rootSuffix}cache.json`)
      .then(response => response.json())
      .then((response) => {
        // mock client.query response
        return {
          data: new InMemoryCache().restore(response).readQuery(params)
        };
      });
  } else {
    // __APOLLO_STATE__ NOT defined, in "SPA" mode
    return backupQuery(params);
  }
};

export default client;