-- Le thème « Rose & bleu glacier » devient « Girly ✦ Ice blue » (identité du pré-projet)
update students set settings = jsonb_set(settings, '{theme}', '"glacier"') where settings->>'theme' = 'rose';
