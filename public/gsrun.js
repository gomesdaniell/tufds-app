<script src="/public/gsrun.js"></script>
<script>
  function salvarNews() {
    const email = document.getElementById('email').value;
    google.script.run
      .withSuccessHandler(() => alert('Email salvo!'))
      .withFailureHandler(err => alert('Falhou: ' + err))
      .newsletter_save({ email }); // nome do arquivo vira nome do endpoint
  }
</script>
