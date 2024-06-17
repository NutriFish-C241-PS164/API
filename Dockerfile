# Gunakan image node sebagai base image
FROM node:18

# Atur working directory di dalam container
WORKDIR /index

# Salin file package.json dan package-lock.json ke working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Salin semua file dari working directory di host ke working directory di container
COPY . .

# Expose port yang digunakan oleh aplikasi
EXPOSE 8080

# Jalankan aplikasi menggunakan index.js
CMD ["node", "index.js"]
