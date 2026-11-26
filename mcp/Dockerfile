FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /project
COPY mcp/package.json mcp/
RUN cd mcp && npm install --omit=dev
COPY mcp/ mcp/
COPY app/public/ app/public/
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000
WORKDIR /project/mcp
CMD ["node","server.mjs","--http"]
