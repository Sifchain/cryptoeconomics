#
# Cryptoeconomics Docker
#

# Build
FROM mhart/alpine-node:latest AS build

WORKDIR /app/cryptoeconomics/
COPY . .

# Build.
RUN yarn install

# Release
FROM mhart/alpine-node:latest AS release

WORKDIR /app/cryptoeconomics/
COPY --from=build /app/cryptoeconomics/ .

EXPOSE 3000

CMD ["yarn", "server"]
