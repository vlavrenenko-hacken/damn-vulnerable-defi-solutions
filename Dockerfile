FROM trailofbits/eth-security-toolbox:latest
COPY ./ /project
RUN cd /project
RUN sudo rm -rf node_modules package-lock.json
WORKDIR /project/contracts