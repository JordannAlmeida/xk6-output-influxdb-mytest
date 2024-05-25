import http from 'k6/http';
import { check, sleep } from 'k6';

const environment = __ENV.TESTENV || 'prd';
const applicationEnvironment = JSON.parse(openFormatedjson(`./parameters/application.${environment}.json`));
const users = JSON.parse(openFormatedjson('./secrets/users.json'));
const maxDelaySleep = applicationEnvironment['sleep']['maxTimeDelay'] || 5;
const minDelaySleep = applicationEnvironment['sleep']['minTimeDelay'] || 0.3;
const authTokens = {};

const getRandomTimeDelay = () => {
  return Math.random() * (maxDelaySleep - minDelaySleep + 1) + minDelaySleep;
}

export let options = {
  stages: applicationEnvironment['stages'],
  ext: applicationEnvironment['ext'],
};

const loginUser = (user) => {
  const loginRes = http.post(applicationEnvironment['authParams']['routeLogin'], {
    username: user.username,
    password: user.password,
  });

  check(loginRes, {
    'login succeeded': (r) => r.status === 200,
  });

  const authToken = loginRes.json('token');
  authTokens[user.username] = authToken;
}

export function setup() {
  if (applicationEnvironment['authParams']['isActive']) {
    users.forEach(user => {
      loginUser(user);
    });
  }
}

export default function () {
  let headers = undefined;
  if(applicationEnvironment['authParams']['isActive']) {
    const user = users[Math.floor(Math.random() * listUsers.length)];
    const authToken = authTokens[user.username];
    headers = {
      Authorization: `Bearer ${authToken}`,
    };
  }
  const params = applicationEnvironment['endpointToTest']['params'];
  let res = http.get(
            applicationEnvironment['endpointToTest']['route'],
            (
              headers ?
              {
                ...params,
                "headers": headers
              } : applicationEnvironment['endpointToTest']['params']
            )
  );
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time is less than 500ms': (r) => r.timings.duration < 200
  });
  sleep(getRandomTimeDelay());
}