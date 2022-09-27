FROM trailofbits/eth-security-toolbox:latest
COPY ./ /project
RUN cd /project
# RUN npm install
WORKDIR /project
