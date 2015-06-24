#!/bin/bash

mongod --dbpath ./data &>/dev/null &

pid=$!

while true
do
	npm start 2>>stderr.log
done

kill $pid

