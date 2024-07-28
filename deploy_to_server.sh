#!/bin/bash -x

cd `dirname $0`
pwd

read servers < servers.txt

files=(
    src/dist/prod
)

for server in ${servers[@]}
do
  echo "============= ${server} ============="
  ssh ${server} sudo -S systemctl stop dokushokanjobun-api.service
  sleep 5

  ssh ${server} ls
  ssh ${server} pwd

  for file in ${files[@]}
  do
    ls ${file}
    scp -r ${file} ${server}:/home/ubuntu/
  done

  ssh ${server} ls /home/ubuntu/

  ssh ${server} sudo -S systemctl restart dokushokanjobun-api.service

  echo "============= ${server} ============="
  echo
done
