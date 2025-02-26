# Node.js’ning engil versiyasidan foydalanamiz
FROM node:18-alpine

# Ishchi papkani yaratamiz
WORKDIR /app

# package.json va package-lock.json’ni ko‘chiramiz
COPY package.json ./

# Bog‘liqliklarni o‘rnatamiz
RUN npm install

# Barcha loyiha fayllarni ko‘chiramiz
COPY . .

# Serverni ishga tushirish buyrug‘i
CMD ["node", "server.js"]

# Portni ochib qo‘yamiz
EXPOSE 5000