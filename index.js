const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

const RESEND_KEY = 're_bbAQ1wXm_FP8fxXEeJeRLUdQpUvR2iBRE';
const resend = new Resend(RESEND_KEY);
const FROM_EMAIL = 'onboarding@resend.dev';

const CLUB_EMAILS = {
  'Авиамоторная': 'corpmanager41@xfit.ru',
  'Алтуфьево': 'corpmanager25@xfit.ru',
  'Парк Победы': 'corpmanager60@xfit.ru',
  'Сан-Сити': 'Corpmanager42@xfit.ru',
  'Химки': 'corpmanager47@xfit.ru',
  'Чистые пруды': 'corpmanager61@xfit.ru',
  'Проверка': 'd4mnmanager@gmail.com',
  'Проверка 2': 's.vladykina@xfit.ru'
};

const MONGO_URI = "mongodb://yrik9890_db_user:vSEzSx1ut2vcVvwj@ac-c47ymxl-shard-00-00.1fvhsui.mongodb.net:27017,ac-c47ymxl-shard-00-01.1fvhsui.mongodb.net:27017,ac-c47ymxl-shard-00-02.1fvhsui.mongodb.net:27017/?ssl=true&replicaSet=atlas-z4zlwy-shard-0&authSource=admin&appName=Cluster0";
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ База данных подключена'))
  .catch((err) => console.error('❌ Ошибка БД:', err));


const ApplicationSchema = new mongoose.Schema({
  fullName: String,
  phone: String,
  company: String,
  city: { type: String, default: 'Москва' },
  club: { type: String, required: true },
  cardType: { type: String, default: 'new' },
  prevCardDate: Date,
  status: { type: String, default: 'new' },
  createdAt: { type: Date, default: Date.now }
});
const Application = mongoose.model('Application', ApplicationSchema);

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetCode: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('UserNew', UserSchema);

app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Такой Email уже зарегистрирован' });
    }
    
    const newUser = new User({ email, password });
    await newUser.save();
    console.log(`✅ Создан пользователь: ${email}`);
    res.status(201).json({ message: 'ОК' });
  } catch (err) { 
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' }); 
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.password !== password) return res.status(400).json({ error: 'Неверный email или пароль' });
    
    res.json({ message: 'ОК', userId: user._id, email: user.email });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Пользователь с таким Email не найден' });

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    user.resetCode = code;
    await user.save();

    const mailData = {
      from: FROM_EMAIL,
      to: email,
      subject: 'Код восстановления пароля XFIT',
      text: `Ваш код для сброса пароля: ${code}`
    };

    resend.emails.send(mailData)
      .then(() => console.log('Код отправлен на', email))
      .catch(err => console.error('Ошибка отправки кода:', err.message));
    res.json({ message: 'Код отправлен' });

  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.resetCode !== code) return res.status(400).json({ error: 'Неверный код' });

    user.password = newPassword;
    user.resetCode = null;
    await user.save();

    res.json({ message: 'Пароль успешно изменен' });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/applications', async (req, res) => {
  try {
    const apps = await Application.find().sort({ createdAt: -1 });
    res.json(apps);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/applications', async (req, res) => {
  try {
    const newApp = new Application(req.body);
    await newApp.save();

    const managerEmail = CLUB_EMAILS[req.body.club];

    if (managerEmail) {
      let dateString = '';
      if (req.body.prevCardDate) {
        const dateObj = new Date(req.body.prevCardDate);
        const formattedDate = dateObj.toLocaleDateString('ru-RU', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
        dateString = `\n📅 Дата окончания карты: ${formattedDate}`;
      }

      const mailData = {
        from: FROM_EMAIL,
        to: managerEmail,
        subject: `Новая заявка: ${req.body.fullName} (${req.body.club})`,
        text: `
--- ДЕТАЛИ ЗАЯВКИ ---
ФИО: ${req.body.fullName}
Телефон: ${req.body.phone}
Компания: ${req.body.company}
Тип карты: ${req.body.cardType}
Клуб: ${req.body.club}${dateString}
---------------------
Пожалуйста, свяжитесь с клиентом.
        `
      };

      resend.emails.send(mailData)
        .then(() => console.log('Письмо ушло на', managerEmail))
        .catch(err => console.error('ОШИБКА ПОЧТЫ:', err.message));
    }
    res.status(201).json(newApp);
  } catch (err) { 
    console.error(err);
    res.status(400).json({ error: err.message }); 
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Сервер на порту ${PORT}`));