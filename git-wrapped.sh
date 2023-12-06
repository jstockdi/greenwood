echo "Total Commits"

git log --since=2023-01-01 --until=2023-12-31 --pretty=oneline | wc -l

echo "\n"


echo "Top Committer"

git log --since=2023-01-01 --until=2023-12-31 --pretty=format:'%ae' | sed 's/egidijus.gegeckas@gmail.com/egegeckas@marstone.com/g' | sort | uniq -c | sort -n  | tail -1


echo "\n"


echo "Lines added and deleted"

git log --since=2023-01-01 --until=2023-12-31 --pretty=tformat: --numstat | awk '{inserted+=$1; deleted+=$2} END {printf "Total lines added: %s\nTotal lines deleted: %s\n", inserted, deleted}'


echo "\n"

echo "Day of the week with the most commits"

for i in `git log --since=2023-01-01 --until=2023-12-31 --pretty=format:'%at'`
do
echo $i |  date -d @$i +%A
done | sort | uniq -c | sort -n | tail -1


echo "\n"

echo "Day of the week with the least commits"

for i in `git log --since=2023-01-01 --until=2023-12-31 --pretty=format:'%at'`
do
echo $i |  date -d @$i +%A
done | sort | uniq -c | sort -n | head -1


echo "\n"

echo "Most modified files"

git log --name-only --since=2023-01-01 --until=2023-12-31   | grep -v "commit" | grep -v "Author" | grep -v "Date" | grep -v "^ " | grep -v "json"  | sort | uniq -c | sort -n | tail -5 | head -4
