#!/bin/bash

MONGODIR='/Users/ecpeterson/Documents/code/node.js/mongodb'

$MONGODIR/mongod --dbpath ./data &>/dev/null &

pid=$!

npm start

kill $pid

