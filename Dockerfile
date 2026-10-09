FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
# Los datos viven en /app/data: móntalo en un disco persistente o se pierden al reiniciar
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
