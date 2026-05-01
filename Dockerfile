FROM mcr.microsoft.com/playwright:v1.44.1-jammy

# Çalışma dizinini ayarla
WORKDIR /app

# Paket dosyalarını kopyala ve kur
COPY package*.json ./
RUN npm install

# Projenin geri kalanını kopyala
COPY . .

# Çevresel değişkenler ve Port
ENV PORT=3000
EXPOSE 3000

# Uygulamayı başlat
CMD ["npm", "start"]
