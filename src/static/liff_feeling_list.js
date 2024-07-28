const liffId = "2005785048-OvnKb02X"

let feelingId = "none";
let userId = "none"

window.addEventListener('load', () => {
    console.log(feelingId)
    liff.init({
        liffId: liffId, // Use own liffId
    })
        .then(() => {
            const idToken = liff.getDecodedIDToken();
            userId = idToken.sub;

            fetch(`/api/user/${userId}/feeling`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                console.log('感情文データ:', data);

                const tableBody = document.querySelector('#data-table tbody');
                tableBody.innerHTML = '';  // テーブルをクリア

                data.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.bookTitle}</td>
                        <td><a href="feeling_viewer.html?feelingId=${item.feelingId}">感情文を見る</a></td>
                    `;
                    tableBody.appendChild(row);
                });
            })
            .catch(error => {
                console.error('Error fetching review data:', error);
            });
        })
        .catch((err) => {
            console.log(err);
        });
});
