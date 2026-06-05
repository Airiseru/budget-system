FROM node:24-alpine
RUN npm install -g nextjs-crons
CMD ["nextjs-crons", "--url", "http://localhost:3000"]