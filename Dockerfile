FROM node:26-bookworm-slim AS client
WORKDIR /src/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS server
WORKDIR /src
COPY server/server.csproj server/
RUN dotnet restore server/server.csproj
COPY server/ server/
RUN dotnet publish server/server.csproj -c Release --no-restore -o /out /p:UseAppHost=false
COPY --from=client /src/client/dist /out/wwwroot

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
RUN mkdir -p /data/keys && chown -R 1654:1654 /data
COPY --from=server /out .
USER 1654:1654
ENV ASPNETCORE_HTTP_PORTS=8080 ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "server.dll"]
