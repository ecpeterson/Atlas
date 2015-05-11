#!/bin/bash

mongod --dbpath ./data &>/dev/null &

pid=$!

npm start

kill $pid

