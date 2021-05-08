#
# Cryptoeconomics Docker
#

# Build
FROM mhart/alpine-node:14.13.0 AS build

WORKDIR /app/cryptoeconomics/
COPY . .

# Build.
RUN yarn install

# Release
FROM mhart/alpine-node:14.13.0 AS release

WORKDIR /app/cryptoeconomics/
COPY --from=build /app/cryptoeconomics/ .

EXPOSE 3000

CMD ["yarn", "server"]
