const mongoose = require("mongoose");

const reservaSchema = new mongoose.Schema({
  sala: String,
  dataInicio: Date,
  dataFim: Date,
  horarioInicio: String,
  horarioFim: String,
  finalidade: String,
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" },
});

module.exports = mongoose.model("Reserva", reservaSchema);
